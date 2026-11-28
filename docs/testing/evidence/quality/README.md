# Final executed quality results

Local SonarQube analysis of candidate `3033321573bb66554df53a9a834b51312a8a61c3` completed on 26 November 2026. `sonar-result.json` records scanner exit 0, gate OK and zero disabled rules. `sonar-scanner.log` is the actual execution log. `sonar-gate.json`, `sonar-measures.json`, `sonar-issues.json`, `sonar-hotspots.json` are raw API exports.

Current overall coverage 87.1%, line coverage 90.6%, branch coverage 80.7%; new-code coverage 93.2%. Bugs, vulnerabilities and hotspots: 0. Open code smells: 3. See `SONAR-ISSUES-AND-ACTIONS.md` for every issue, severity, file, action, reason and residual debt.

Coverage.py's repository-relative filenames already begin `src/`. Only `<sources>` was normalized to `/usr/src` for the scanner's Docker mount; execution hits and denominators are unchanged. `sonar-import-coverage.xml` preserves this actual input. `initial-path-import-error/` retains the earlier failed import and gate; it is superseded, not deleted or relabelled as passing.

Scanner image: `sonarsource/sonar-scanner-cli@sha256:6e6eca4d552695a98fb7dab84f0c1bd0885ebbfe272654d1552e24bd7f452d51`. Sources: `src,frontend/src`; exclude frontend test/spec/live files and the test JWT helper. Import the backend XML and frontend LCOV; no production source module was excluded. Sonar SCM discovery was disabled because this Windows worktree uses an external Git pointer; the exact revision was supplied explicitly. The project's unchanged previous-version baseline is `review-8c41151`.
