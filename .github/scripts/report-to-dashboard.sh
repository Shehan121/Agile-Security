#!/bin/sh
# Sends every security report downloaded into $REPORTS_DIR to the
# Vulnerability Dashboard (POST /vulnerabilities).
#
# Each report is converted with jq to the dashboard's ingest format, using the
# app and tool names its filters expect. A report that is missing or empty is
# skipped, so the dashboard keeps that tool's previous results.
#
# Env: DASHBOARD_URL (required), REPORTS_DIR (default: reports), RUN_ID

REPORTS_DIR=${REPORTS_DIR:-reports}
RUN_ID=${RUN_ID:-manual}

SEMGREP='[.vulnerabilities[]? |
  {severity: (.severity | ascii_upcase | if . == "INFO" or . == "UNKNOWN" then "LOW" else . end),
   title: (.identifiers[0].value // .name // .message),
   description: (.description // .message // ""),
   file_path: "\(.location.file):\(.location.start_line)"}]'

GITLEAKS='[.[]? | {severity: "HIGH", title: .RuleID, description: .Description, file_path: "\(.File):\(.StartLine)"}]'

DEPCHECK='[.dependencies[]? | .fileName as $f | .vulnerabilities[]? |
  {severity: (.severity | ascii_upcase | if . == "MODERATE" then "MEDIUM" else . end),
   title: .name, description: (.description // "")[0:500], file_path: $f}]'

NPM_AUDIT='[(.vulnerabilities // {}) | to_entries[] |
  {severity: (.value.severity | ascii_upcase | if . == "MODERATE" then "MEDIUM" elif . == "INFO" then "LOW" else . end),
   title: .key,
   description: ([.value.via[] | objects | "\(.title) \(.url // "")"] | join("; ")),
   file_path: "package.json"}]'

TRIVY='[.Results[]? | .Target as $t | .Vulnerabilities[]? |
  {severity: .Severity, title: .VulnerabilityID,
   description: "\(.PkgName) \(.InstalledVersion): \(.Title // "")", file_path: $t}]'

ZAP='[.site[]?.alerts[]? |
  {severity: (.riskdesc | split(" ")[0] | ascii_upcase | if . == "INFORMATIONAL" then "LOW" else . end),
   title: .name, description: (.desc | gsub("<[^>]*>"; ""))[0:500], file_path: (.instances[0].uri // "")}]'

post() {
  app=$1; tool=$2; file=$REPORTS_DIR/$3; filter=$4
  if [ ! -s "$file" ]; then echo "skip $app/$tool: no $file"; return; fi
  jq "$filter" "$file" \
    | jq --arg app "$app" --arg tool "$tool" --arg run "$RUN_ID" \
        '{app: $app, tool: $tool, run_id: $run, vulnerabilities: .}' \
    | curl -sS --fail -X POST -H 'Content-Type: application/json' --data @- "$DASHBOARD_URL/vulnerabilities" \
    || echo "warn: posting $app/$tool to $DASHBOARD_URL failed"
  echo
}

post Todolist  Semgrep        todolist-semgrep/gl-sast-report.json             "$SEMGREP"
post Todolist  Gitleaks       todolist-gitleaks/gitleaks-report.json           "$GITLEAKS"
post Todolist  OWASP-DepCheck todolist-dependency-check/dependency-check-report.json "$DEPCHECK"
post Todolist  Trivy          todolist-trivy/trivy-report.json                 "$TRIVY"
post Todolist  OWASP-ZAP      todolist-zap/zap-report.json                     "$ZAP"

post JuiceShop Semgrep        juiceshop-semgrep/gl-sast-report.json            "$SEMGREP"
post JuiceShop Gitleaks       juiceshop-gitleaks/gitleaks-report.json          "$GITLEAKS"
post JuiceShop npm-audit      juiceshop-npm-audit/audit-report.json            "$NPM_AUDIT"
post JuiceShop Trivy          juiceshop-trivy/trivy-report.json                "$TRIVY"
post JuiceShop OWASP-ZAP      juiceshop-zap/zap-report.json                    "$ZAP"
