param(
  [string]$BaseUrl = "https://c59estatehub.com",
  [string]$WwwUrl = "https://www.c59estatehub.com"
)

$ErrorActionPreference = "Stop"

$RequiredHeaders = @(
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy"
)

function Invoke-Head {
  param(
    [string]$Url,
    [hashtable]$Headers = @{},
    [int]$MaximumRedirection = 5
  )

  try {
    return Invoke-WebRequest -Uri $Url -Method Head -Headers $Headers -MaximumRedirection $MaximumRedirection
  } catch {
    if ($_.Exception.Response) {
      return $_.Exception.Response
    }

    throw
  }
}

function Assert-Status {
  param(
    [string]$Label,
    [object]$Response,
    [int[]]$Expected
  )

  $status = [int]$Response.StatusCode
  if ($Expected -notcontains $status) {
    throw "$Label returned HTTP $status. Expected: $($Expected -join ', ')."
  }

  Write-Host "[ok] $Label HTTP $status"
}

function Assert-SecurityHeaders {
  param(
    [string]$Label,
    [object]$Response
  )

  foreach ($header in $RequiredHeaders) {
    if (-not $Response.Headers[$header]) {
      throw "$Label is missing required security header: $header"
    }
  }

  Write-Host "[ok] $Label security headers present"
}

$homeResponse = Invoke-Head -Url $BaseUrl
Assert-Status -Label "Apex homepage" -Response $homeResponse -Expected @(200)
Assert-SecurityHeaders -Label "Apex homepage" -Response $homeResponse

$www = Invoke-Head -Url $WwwUrl -MaximumRedirection 0
Assert-Status -Label "WWW redirect" -Response $www -Expected @(301, 302, 307, 308)
if ($www.Headers["Location"] -notlike "$BaseUrl*") {
  throw "WWW redirect points to '$($www.Headers["Location"])', expected '$BaseUrl'."
}
Write-Host "[ok] WWW redirects to apex"

foreach ($path in @("/login", "/api/listings?limit=1")) {
  $response = Invoke-Head -Url "$BaseUrl$path"
  Assert-Status -Label $path -Response $response -Expected @(200)
  Assert-SecurityHeaders -Label $path -Response $response
}

$cronUnauth = Invoke-Head -Url "$BaseUrl/api/cron/auto-refresh" -MaximumRedirection 0
Assert-Status -Label "Cron without secret" -Response $cronUnauth -Expected @(401)

if ($env:CRON_SECRET) {
  $cronAuth = Invoke-Head -Url "$BaseUrl/api/cron/auto-refresh" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
  Assert-Status -Label "Cron with secret" -Response $cronAuth -Expected @(200)
} else {
  Write-Host "[skip] Set CRON_SECRET locally to test authorized cron access"
}

Write-Host "Production smoke check passed."
