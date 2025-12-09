# =============================================================================
# ALB Module Outputs
# =============================================================================

output "alb_id" {
  description = "ID of the ALB"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "ARN of the ALB"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB"
  value       = aws_lb.main.arn_suffix
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB"
  value       = aws_lb.main.zone_id
}

output "security_group_id" {
  description = "Security group ID of the ALB"
  value       = aws_security_group.alb.id
}

output "security_group_arn" {
  description = "Security group ARN of the ALB"
  value       = aws_security_group.alb.arn
}

output "http_listener_arn" {
  description = "ARN of the HTTP listener"
  value       = aws_lb_listener.http.arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "target_group_arns" {
  description = "Map of service name to target group ARN"
  value       = { for k, v in aws_lb_target_group.services : k => v.arn }
}

output "target_group_arn_suffixes" {
  description = "Map of service name to target group ARN suffix"
  value       = { for k, v in aws_lb_target_group.services : k => v.arn_suffix }
}

output "target_group_names" {
  description = "Map of service name to target group name"
  value       = { for k, v in aws_lb_target_group.services : k => v.name }
}

output "alb_resource_labels" {
  description = "Map of service name to ALB resource label (for auto scaling)"
  value = {
    for k, v in aws_lb_target_group.services :
    k => "${aws_lb.main.arn_suffix}/${v.arn_suffix}"
  }
}
