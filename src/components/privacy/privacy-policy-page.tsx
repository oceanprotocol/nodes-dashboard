import Button from '@/components/button/button';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import React from 'react';
import styles from './privacy-policy.module.css';

const LinkButton: React.FC<{ children: React.ReactNode; href: string }> = ({ children, href }) => {
  return (
    <Button color="accent1" href={href} size="link" target="_blank" variant="transparent">
      {children}
    </Button>
  );
};

const PrivacyPolicyPage: React.FC = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Privacy Policy"
        subTitle="TL;DR: If you have Do Not Track activated or do not interact with our cookie banner, we don’t collect any information at all about your visit on our site. If you accept cookies, we make sure to only collect the bare minimum of information needed, as described in this Privacy Policy."
      />
      <div className={styles.policyContent}>
        <div className={styles.policySection}>
          <h3>Introduction</h3>
          <p>
            Our Privacy Policy sets out how your personal information is collected and used while you use our site. We
            believe your personal information belongs to you, so we are very open about how we use it.
          </p>
          <p>
            If you have questions about the Privacy Policy, want to know what data we store about you, or if you want to
            withdraw your consent to any data processing, let us know by emailing{' '}
            <LinkButton href="mailto:gdpr@oceanprotocol.com">gdpr@oceanprotocol.com</LinkButton>.
          </p>
        </div>
        <div className={styles.policySection}>
          <h3>Our Policies</h3>
          <p>
            We collect and use information in accordance with the GDPR, or with your specific and express consent. We
            may process your data outside of the EU but regardless of where we process it, we will always conform to EU
            level data privacy and data protection standards.
          </p>
          <p>
            We do not knowingly collect personal information from children under 18 without consent from a parent or
            guardian. If we learn a child has provided personal information, we may delete it.
          </p>
        </div>
        <div className={styles.policySection}>
          <h3>What Information We Collect and How We Use It</h3>
          <p>
            When you visit our site, we don’t log any information about your visit. We also don’t load any 3rd party
            scripts tracking your individual behavior across multiple channels, like A/B testing tools, social network
            or sharing buttons, and so on.
          </p>
          <p>
            We simply don’t measure your engagement with our brand based on tracking you, because we believe this is
            always in violation of your privacy, and ultimately meaningless.
          </p>
          <div className={styles.policySection}>
            <h4>Web Services</h4>
            <p>
              The site communicates against those services where some data collection, like time of request and the
              user’s IP address might be collected:
            </p>
            <p>
              <ul>
                <li>
                  <LinkButton href="https://substack.com/">Substack</LinkButton>, subject to their{' '}
                  <LinkButton href="https://substack.com/tos">Terms</LinkButton> and{' '}
                  <LinkButton href="https://substack.com/privacy">Privacy Policy</LinkButton>
                </li>
                <li>
                  <LinkButton href="https://www.cloudflare.com/">Cloudflare</LinkButton>, subject to their{' '}
                  <LinkButton href="https://www.cloudflare.com/terms/">Terms</LinkButton> and{' '}
                  <LinkButton href="https://www.cloudflare.com/privacypolicy/">Privacy Policy</LinkButton>
                </li>
                <li>
                  <LinkButton href="https://vercel.com/">Vercel</LinkButton>, subject to their{' '}
                  <LinkButton href="https://vercel.com/legal/terms">Terms</LinkButton> and{' '}
                  <LinkButton href="https://vercel.com/legal/privacy-policy">Privacy Policy</LinkButton>
                </li>
              </ul>
            </p>
            <p>
              Additionally, if you are submitting one of our web forms, your entered data is stored and processed with:
            </p>
            <p>
              <ul>
                <li>
                  <LinkButton href="https://posthog.com/">PostHog</LinkButton>, subject to their{' '}
                  <LinkButton href="https://posthog.com/terms">Terms</LinkButton> and{' '}
                  <LinkButton href="https://posthog.com/privacy">Privacy Policy</LinkButton>
                </li>
                <li>
                  <LinkButton href="https://workspace.google.com/products/sheets/">Google Sheets</LinkButton>, subject
                  to their <LinkButton href="https://policies.google.com/terms?hl=en">Terms</LinkButton> and{' '}
                  <LinkButton href="https://policies.google.com/privacy?hl=en">Privacy Policy</LinkButton>
                </li>
              </ul>
            </p>
          </div>
          <div className={styles.policySection}>
            <h4>Cookies</h4>
            <p>
              A cookie is a small file that stores Internet settings. Almost every website uses cookie technology. It is
              downloaded by your web browser on the first visit to a website. The next time this website is opened with
              the same user device, the cookie and the information stored in it is either sent back to the website that
              created it (first-party cookie) or sent to another website it belongs to (third-party cookie). This
              enables the website to detect that you have opened it previously with this browser and in some cases to
              vary the displayed content.
            </p>
            <p>
              When you first arrive on our site, a cookie banner will be shown. By accepting the cookies you help us to
              provide better content in the future. The only downside for rejecting cookies on your side is that you
              will not be able to see some content loaded from external sources,which at the moment is only Twitter
              content.
            </p>
            <p>
              On our site, only Google Analytics and Twitter set cookies. We have to set a cookie of our own though, for
              remembering your acceptance or rejection of our cookie banner. This cookie will stay in your browser for
              13 months, unless you delete it manually. This is so we can detect your acceptance or rejection on your
              next visit, and adapt the site accordingly.
            </p>
            <p>
              If you have Do Not Track activated in your browser, or if you rejected our cookie banner, we won’t let
              Google set any cookies in your browser.
            </p>
            <p>
              You also have the option of disabling cookies in your browser setting, and deleting cookies from your
              computer’s hard disk at any time.
            </p>
            <p>If you want to change your cookie consent click the Cookie Settings link in the bottom of the page.</p>
            <p>
              In general, you can block cookies by using your browser’s settings, or by installing a browser add-on such
              as <LinkButton href="https://privacybadger.org/">Privacy Badger</LinkButton> or{' '}
              <LinkButton href="https://github.com/gorhill/uBlock">uBlock Origin</LinkButton>.
            </p>
          </div>
          <div className={styles.policySection}>
            <h4>Google Analytics</h4>
            <p>
              The site uses Google Analytics, which provides us with anonymized information about our users (such as
              anonymized IP address, browser version, and so on) and how they use the site. We use this information to
              make the site better.
            </p>
            <p>
              The collected IP addresses are truncated before being sent to Google, making them anonymized. Google
              Analytics also sets cookies.
            </p>
            <p>
              If you hit Reject on the cookie banner, all previously set Google cookies will be deleted, and the
              rejection is stored in a cookie CookieConsent with value of false.
            </p>
          </div>
        </div>
        <div className={styles.policySection}>
          <h3>Marketing Activities</h3>
          <p>We may transfer your personal data to our business partners:</p>
          <p>
            <LinkButton href="https://www.bigchaindb.com/">BigchainDB GmbH</LinkButton> Bernauer Str. 49 10435 Berlin
            Germany
          </p>
        </div>
        <div className={styles.policySection}>
          <h3>Contact & Data Controller</h3>
          <p>For any requests you can contact us as follows:</p>
          <p>Ocean Protocol Foundation Ltd. 1 Irving Place 08-11 (The Commerze @ Irving) Singapore, 369546 Singapore</p>
          <p>
            <LinkButton href="mailto:gdpr@oceanprotocol.com">gdpr@oceanprotocol.com</LinkButton>
          </p>
        </div>
        <div className={styles.policySection}>
          <h3>Other Terms & Policies</h3>
          <p>
            <ul>
              <li>
                <LinkButton href="https://oceanprotocol.com/terms-prelaunch">
                  Terms & Privacy Policy for Pre-Launch
                </LinkButton>
              </li>
              <li>
                <LinkButton href="https://oceanprotocol.com/terms-launch">
                  Terms & Privacy Policy for Network Launch
                </LinkButton>
              </li>
            </ul>
          </p>
        </div>
      </div>
    </Container>
  );
};

export default PrivacyPolicyPage;
