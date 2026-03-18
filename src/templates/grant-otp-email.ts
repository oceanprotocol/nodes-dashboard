import config from '@/config';

export function getGrantOtpEmailTemplate({ otp }: { otp: string }) {
  const year = new Date().getFullYear();
  return `
      <title>Verification Code for Ocean Network Grant</title>
      <!-- Header -->
      <tr>
        <td style="padding:32px; text-align:center; background:linear-gradient(135deg, #d54335, #d85548);">
          <h1 style="margin:0; font-size:24px; color:#b7fd79;">
            Ocean Network Grant
          </h1>
          <p style="margin:8px 0 0; font-size:14px; color:#ffffff;">
            Email verification code
          </p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px; font-size:16px;">
            Hi,
          </p>

          <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:#374151;">
            Use the verification code below to continue your claim for grant tokens on <a href="${config.links.website}" target="_blank" style="color:#d54335; text-decoration:none;">Ocean Network.
          </p>

          <!-- Code -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td align="center" style="border:2px dashed #eaa39c; border-radius:12px; padding:24px;">
                <p style="margin:0 0 8px; font-size:12px; color:#6b7280; letter-spacing:1px; text-transform:uppercase;">
                  Verification Code
                </p>
                <p style="margin:0; font-size:34px; font-weight:bold; letter-spacing:8px; color:#d54335;">
                  ${otp}
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 24px; font-size:13px; color:#6b7280;">
            If you didn't request this, you can safely ignore this email.
          </p>

          <!-- Divider -->
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

          <!-- Resources -->
          <p style="margin:0 0 12px; font-size:14px; font-weight:bold; color:#111827;">
            Get started
          </p>

          <ul style="padding-left:18px; margin:0 0 20px; font-size:14px; color:#374151; line-height:22px;">
            <li>
              📚 Explore the 
              <a href="${config.links.docs}" target="_blank" style="color:#d54335; text-decoration:none;">
                Docs
              </a>
            </li>
            <!-- add also vsx i've added only vs code marketplace -->
            <li>
              🛠 Install 
              <a href="https://marketplace.visualstudio.com/items?itemName=OceanProtocol.ocean-protocol-vscode-extension" target="_blank" style="color:#d54335; text-decoration:none;">
                Ocean Orchestrator extension
              </a>
            </li>
          </ul>

          <p style="margin:0 0 12px; font-size:14px; font-weight:bold; color:#111827;">
            Join the community
          </p>

          <ul style="padding-left:18px; margin:0; font-size:14px; color:#374151; line-height:22px;">
            <li>
              💬 Join 
              <a href="${config.socialMedia.discord}" target="_blank" style="color:#d54335; text-decoration:none;">
                Discord
              </a>
            </li>
            <li>
              🐦 Follow on 
              <a href="${config.socialMedia.twitter}" target="_blank" style="color:#d54335; text-decoration:none;">
                X (Twitter)
              </a>
            </li>
          </ul>

          <p style="margin:24px 0 0; font-size:14px; color:#374151;">
            Happy computing ⚡
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px; text-align:center; background:#d54335;">
          <p style="margin:0; font-size:12px; color:#ffffff;">
            © ${year} Ocean Network
          </p>
        </td>
      </tr>

    </table>
  </td>
</tr>
`;
}
