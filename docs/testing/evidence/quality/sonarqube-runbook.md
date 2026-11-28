> Historical reproduction procedure. Final executed results and their source scopes are indexed in [README.md](README.md); any earlier pending status below is superseded.

# SonarQube quality evidence plan

Status: ready for coordination; measurement pending. Runner: Özgür's Docker environment. Obtain the SonarQube URL, project key, scanner version and a project-scoped token through the team. Record the pinned application SHA, server/scanner versions and active quality gate before scanning. Keep the token outside the repository and terminal output.

1. Check out the agreed SHA, install the pinned test dependencies and start the isolated test services. Use the existing CI service flags and migration/seed procedure. Keep the coverage run and scan at the same revision.
2. From the repository root, set up a fresh coverage data file. Run the test suite with branch coverage and source `src` using `coverage run --branch --source=src -m pytest tests --junitxml=qa-tests.xml`. Preserve the test exit status and counts, including failed/skipped cases. Export with `coverage xml -o coverage.xml`. Confirm the source paths resolve from the scanner's working directory; when portability is needed, generate coverage with coverage.py relative_files enabled.
3. With SONAR_HOST_URL and SONAR_TOKEN in the scanner process environment, run the team's pinned SonarScanner from the repository root:

    sonar-scanner -Dsonar.projectKey="$SONAR_PROJECT_KEY" -Dsonar.sources=src,frontend/src -Dsonar.tests=tests -Dsonar.exclusions="**/node_modules/**,**/dist/**,frontend/src/**/*.test.*,frontend/src/**/*.spec.*,frontend/src/**/*.live.*" -Dsonar.python.coverage.reportPaths=coverage.xml -Dsonar.qualitygate.wait=true

   The Python report covers only src. Record frontend coverage as unavailable unless separately collected and imported. Confirm the scanner reports the Python coverage import and verify analyzed file counts. Use Bash for the command shown, or pass the same arguments as quoted strings in PowerShell.
4. Record analysis URL, task ID, SHA, scan/test exit codes, quality gate, code coverage, issue counts by severity and unresolved items. Save a redacted scanner transcript and gate export. Classify run as blocked if the scanner cannot reach the server or cannot read its coverage input. Distinguish an analysis failure from a failed gate.

Reference: [SonarQube Python coverage](https://docs.sonarsource.com/sonarqube-server/2025.1/analyzing-source-code/test-coverage/python-test-coverage).
