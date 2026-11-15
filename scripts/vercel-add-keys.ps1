# Adds the two key values from .env.local to the linked Vercel project (Production),
# without printing them. Run from the project folder:  .\scripts\vercel-add-keys.ps1
# Never add SUPABASE_SERVICE_ROLE_KEY to Vercel: the site doesn't use it.

$names = @("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "GEMINI_API_KEY")
$lines = Get-Content ".env.local"

foreach ($name in $names) {
  $line = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) { Write-Host "Missing $name in .env.local, skipped."; continue }
  $value = ($line -replace "^\s*$name\s*=\s*", "").Trim().Trim('"').Trim("'")
  if (-not $value) { Write-Host "$name is empty in .env.local, skipped."; continue }
  $value | npx --yes vercel@latest env add $name production | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "Added $name" } else { Write-Host "Could not add $name (it may already exist)" }
}
