# =============================================================================
# Terraform Backend Configuration - Staging
# =============================================================================

terraform {
  backend "s3" {
    bucket         = "skillancer-terraform-state-ACCOUNT_ID"
    key            = "environments/staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "skillancer-terraform-locks"
  }
}
