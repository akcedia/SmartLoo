"""Account access for FR-08: registration, sign-in, signed JWTs and route guards.

Routes use two FastAPI dependencies:
    current_user   -> 401 when the Bearer token is missing, invalid, expired or its user no longer exists
    require_admin  -> current_user, then 403 unless the account has role ADMIN

Accounts live in PostgreSQL (db/migrations/003_create_users.sql). Tests inject
RepositoryAccounts, an isolated in-memory double over the test state.
"""

import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import bcrypt
import jwt
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator

from src.db import connect

TOKEN_LIFETIME_S = 3600
FAILURE_LIMIT = 5
FAILURE_WINDOW_S = 15 * 60
BCRYPT_ROUNDS = 12
GENERIC_LOGIN_ERROR = "Invalid email or password"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Compared against when the email is unknown, so both failure paths cost one bcrypt check.
DUMMY_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


class DuplicateEmail(Exception):
    pass


@dataclass(frozen=True)
class Principal:
    sub: str
    role: str


def normalize_email(email):
    return email.strip().lower()


class RegisterRequest(BaseModel):
    """Unknown fields, including a supplied role, are ignored: registration always creates USER (TC-48)."""

    email: str
    password: str
    display_name: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = normalize_email(value)
        if len(value) > 254 or not EMAIL_PATTERN.match(value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value):
        if len(value) < 8 or not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password needs at least 8 characters, a letter and a digit")
        if len(value.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return value

    @field_validator("display_name")
    @classmethod
    def valid_display_name(cls, value):
        value = value.strip()
        if not 3 <= len(value) <= 30:
            raise ValueError("Display name needs 3 to 30 characters")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str


def public_account(user):
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "display_name": user["display_name"],
        "role": user["role"],
    }


class RepositoryAccounts:
    """Isolated account store over the in-memory test state; not a production database."""

    def __init__(self, repository):
        self.users = repository.setdefault("users", {})
        self.failures = repository.setdefault("login_attempts", [])

    def find_by_email(self, email):
        return next((u for u in self.users.values() if u["email"].lower() == email), None)

    def get(self, user_id):
        return self.users.get(user_id)

    def insert(self, email, password_hash, display_name):
        if self.find_by_email(email):
            raise DuplicateEmail
        user = dict(id=str(uuid.uuid4()), email=email, password_hash=password_hash,
                    display_name=display_name, role="USER",
                    created_at=datetime.now(timezone.utc).isoformat())
        self.users[user["id"]] = user
        return user

    def count_failures(self, email, since):
        return sum(1 for f in self.failures if f["email"] == email and f["at"] >= since)

    def record_failure(self, email, at):
        self.failures.append({"email": email, "at": at})


class PostgresAccounts:
    def find_by_email(self, email):
        with connect() as conn:
            return conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()

    def get(self, user_id):
        try:
            uuid.UUID(str(user_id))
        except ValueError:
            return None
        with connect() as conn:
            return conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()

    def insert(self, email, password_hash, display_name):
        try:
            with connect() as conn:
                return conn.execute(
                    """INSERT INTO users (email, password_hash, display_name)
                       VALUES (%s, %s, %s) RETURNING *""",
                    (email, password_hash, display_name),
                ).fetchone()
        except psycopg.errors.UniqueViolation as exc:
            raise DuplicateEmail from exc

    def count_failures(self, email, since):
        with connect() as conn:
            return conn.execute(
                "SELECT count(*) AS n FROM login_failures WHERE email = %s AND failed_at >= to_timestamp(%s)",
                (email, since),
            ).fetchone()["n"]

    def record_failure(self, email, at):
        with connect() as conn:
            conn.execute(
                "INSERT INTO login_failures (email, failed_at) VALUES (%s, to_timestamp(%s))",
                (email, at),
            )


def signing_key(request):
    key = request.app.state.jwt_secret or os.getenv("SMARTLOO_JWT_SECRET")
    if not key or len(key.encode()) < 32:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    return key


def issue_token(key, user, now):
    iat = int(now)
    claims = {"sub": str(user["id"]), "role": user["role"], "iat": iat, "exp": iat + TOKEN_LIFETIME_S}
    return {
        "access_token": jwt.encode(claims, key, algorithm="HS256"),
        "token_type": "Bearer",
        "expires_in": TOKEN_LIFETIME_S,
    }


bearer = HTTPBearer(auto_error=False)
UNAUTHORIZED = {"WWW-Authenticate": "Bearer"}


def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required", headers=UNAUTHORIZED)
    try:
        claims = jwt.decode(credentials.credentials, signing_key(request), algorithms=["HS256"],
                            options={"require": ["sub", "role", "iat", "exp"]})
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers=UNAUTHORIZED) from exc
    # The stored account decides: a deleted account's token stops working, a changed role applies at once.
    user = request.app.state.accounts.get(claims["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers=UNAUTHORIZED)
    return Principal(sub=str(user["id"]), role=user["role"])


def require_admin(principal: Principal = Depends(current_user)):
    if principal.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator role required")
    return principal


router = APIRouter(prefix="/api/v1/auth")


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, request: Request):
    password_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()
    try:
        user = request.app.state.accounts.insert(payload.email, password_hash, payload.display_name)
    except DuplicateEmail as exc:
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    return public_account(user)


@router.post("/login")
def login(payload: LoginRequest, request: Request):
    accounts = request.app.state.accounts
    key = signing_key(request)
    email = normalize_email(payload.email)
    now = request.app.state.clock()
    if accounts.count_failures(email, now - FAILURE_WINDOW_S) >= FAILURE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    user = accounts.find_by_email(email)
    stored = user["password_hash"] if user else DUMMY_HASH
    if not bcrypt.checkpw(payload.password.encode()[:72], stored.encode()) or user is None:
        accounts.record_failure(email, now)
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)
    return issue_token(key, user, now)
