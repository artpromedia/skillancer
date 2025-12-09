# =============================================================================
# Terraform Backend Configuration - Production
# =============================================================================

terraform {
  backend "s3" {
    bucket         = "skillancer-terraform-state-ACCOUNT_ID"
    key            = "environments/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "skillancer-terraform-locks"
  }
}
