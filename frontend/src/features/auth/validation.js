// Client-side checks mirror FR-08 / REQ-SEC-01 and src/auth.py so users get
// feedback before submitting. The server stays authoritative (422).

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return "E-posta gerekli.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

export function validatePassword(value) {
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Parola en az 8 karakter olmalı ve en az bir harf ile bir rakam içermeli.";
  }
  if (new TextEncoder().encode(value).length > 72) return "Parola en fazla 72 bayt olabilir.";
  return null;
}

export function validateDisplayName(value) {
  const name = value.trim();
  if (name.length < 3 || name.length > 30) return "Görünen ad 3–30 karakter olmalı.";
  return null;
}

function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

export function validateSignIn({ email, password }) {
  return compact({ email: validateEmail(email), password: password ? null : "Parola gerekli." });
}

export function validateRegistration({ email, password, display_name }) {
  return compact({
    display_name: validateDisplayName(display_name),
    email: validateEmail(email),
    password: validatePassword(password),
  });
}

// Maps account API errors to Turkish messages. 401 stays generic on purpose:
// it must not reveal whether the email exists (TC-40).
export function authErrorMessage(error, action) {
  switch (error?.status) {
    case 401:
      return "E-posta veya parola hatalı.";
    case 409:
      return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.";
    case 422:
      return "Lütfen işaretli alanları düzeltin.";
    case 429:
      return "Çok fazla başarısız deneme yapıldı. 15 dakika sonra tekrar deneyin.";
    case 503:
      return "Hesap servisi şu anda kullanılamıyor. Daha sonra tekrar deneyin.";
    case 0:
      return "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
    default:
      return action === "register" ? "Kayıt tamamlanamadı. Tekrar deneyin." : "Giriş yapılamadı. Tekrar deneyin.";
  }
}
