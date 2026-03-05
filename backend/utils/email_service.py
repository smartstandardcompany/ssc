import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "SSC Track")


async def send_email(
    to_emails: list,
    subject: str,
    html_body: str,
    attachments: list = None,
):
    """
    Send email via Microsoft 365 SMTP.
    attachments: list of dicts with keys: filename, content (bytes), content_type
    """
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping email send.")
        return False

    msg = MIMEMultipart()
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject

    msg.attach(MIMEText(html_body, "html"))

    if attachments:
        for att in attachments:
            part = MIMEApplication(att["content"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
            timeout=30,
        )
        logger.info(f"Email sent to {to_emails}")
        return True
    except aiosmtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Auth failed (enable SMTP AUTH in M365 admin): {e}")
        return False
    except aiosmtplib.SMTPConnectTimeoutError as e:
        logger.error(f"SMTP connect timeout: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def build_report_email_html(report_type: str, company_name: str = "SSC Track"):
    """Build HTML email body for a scheduled report"""
    report_labels = {
        "sales": "Sales Summary",
        "expenses": "Expenses Summary",
        "pnl": "Profit & Loss",
        "supplier_aging": "Supplier Aging",
    }
    label = report_labels.get(report_type, report_type.replace("_", " ").title())

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10B981; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{company_name}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0;">Scheduled Report</p>
        </div>
        <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">{label} Report</h2>
            <p style="color: #6b7280;">Please find your scheduled <strong>{label}</strong> report attached as a PDF.</p>
            <p style="color: #6b7280; font-size: 14px;">This is an automated report from your SSC Track system.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
                This email was sent automatically by {company_name} via SSC Track.
                To manage your scheduled reports, visit the Scheduled Reports page in your dashboard.
            </p>
        </div>
    </div>
    """
