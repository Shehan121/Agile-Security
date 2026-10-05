# Security pipelines

The two security-integrated GitLab CI/CD pipelines whose findings this
dashboard aggregates. Each file is a complete `.gitlab-ci.yml` for its
application repository. The dashboard's own build-and-deploy pipeline is the
`.gitlab-ci.yml` at the repository root.

| File | Application | Stages |
|---|---|---|
| [`todolist.gitlab-ci.yml`](todolist.gitlab-ci.yml) | ToDo List — Java / Spring Boot / Maven | build, test, sast, package, sca-package, publish, sca-container, deploy, fuzz, dast, report |
| [`juice-shop.gitlab-ci.yml`](juice-shop.gitlab-ci.yml) | OWASP Juice Shop — Node.js | package, sast, sca-package, publish, sca-container, deploy, fuzzing, dast, report |

The originals live on the internal university GitLab and are not public. These
are rebuilt from the project documentation in
[ITSecurity](https://github.com/Shehan121/ITSecurity): the stage lists, the job
names visible in the pipeline screenshots (`docs/images/fig-8.1-*`), the tool
choices, and defect 1 in `docs/acceptance.md`. The tool invocations are new.

## Tooling

| Concern | ToDo List | Juice Shop | Dashboard `tool` |
|---|---|---|---|
| Secret detection | Gitleaks | Gitleaks | `Gitleaks` |
| SAST | Semgrep (`p/java`) | Semgrep (`p/javascript`, `p/typescript`, `p/nodejs`) | `Semgrep` |
| Dependency scanning | OWASP Dependency Check (Maven plugin) | npm audit | `OWASP-DepCheck` / `npm-audit` |
| Container scanning | Trivy | Trivy | `Trivy` |
| Fuzzing | JavaFuzz | jsfuzz | — |
| DAST | OWASP ZAP baseline | OWASP ZAP baseline | `OWASP-ZAP` |

Scanners don't fail the pipeline on findings. They save their reports as job
artifacts. The final `report` stage converts each report with `jq` and sends it
to `POST /vulnerabilities` as app `Todolist` or `JuiceShop`. These are the app
and tool names the dashboard's filters expect. The report job runs even when an
earlier stage fails. If the dashboard can't be reached, it logs a warning and
the pipeline continues.

## CI/CD variables

Set these under *Settings → CI/CD → Variables* in each application project.

| Variable | Used by | Notes |
|---|---|---|
| `SSH_PRIVATE_KEY` | deploy | Key for the deployment VM (masked, protected) |
| `SSH_USER`, `SSH_IP` | deploy, dast | `SSH_IP` also makes the DAST target `http://$SSH_IP:$APP_PORT` |
| `NVD_API_KEY` | `todolist_sca_package` | Without it, NVD rate limits make the 503 failure from defect 1 likely |
| `FUZZ_TARGET_CLASS` | `todolist_fuzz` | Fully-qualified JavaFuzz target class in the todolist project |
| `FUZZ_TARGET` | `JuiceShop_fuzzing` | Path to a jsfuzz target module, e.g. `fuzz/fuzz-target.js` |
| `DASHBOARD_URL` | report | Defaults to `http://10.97.13.101:3001` |

GitLab provides `CI_REGISTRY*`, `CI_JOB_TOKEN` and `CI_API_V4_URL`.

## Assumptions to check against the originals

- **Juice Shop deploy jobs.** The screenshot cuts the names off at
  `JuiceShop_aut…` and `JuiceShop_dep…`. They are filled in here as
  `JuiceShop_auto_deploy` and `JuiceShop_deploy_check`.
- **The stages after `publish`/`deploy`** are off-screen in both screenshots.
  Their job names follow the visible naming pattern.
- **ToDo List unit and integration tests** are split by class name: `*IT` and
  `*IntegrationTest` are integration tests, everything else is a unit test. If
  the project uses Failsafe, switch the integration job to `mvn verify`.
- **`todolist_publish_package`** uploads the jar to GitLab's generic package
  registry, so `pom.xml` needs no `distributionManagement` section.
- **Container ports.** The ToDo List container listens on 8080 and Juice Shop
  on 3000. Change `APP_PORT` to move the host port.
