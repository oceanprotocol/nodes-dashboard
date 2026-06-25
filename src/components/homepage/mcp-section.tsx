import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import { getLinks } from '@/config';
import Container from '../container/container';
import styles from './mcp-section.module.css';

const McpSection = () => {
  const links = getLinks();

  return (
    <section className={styles.root}>
      <Container className={styles.container}>
        <span className={styles.eyebrow}>ON MCP</span>
        <h2 className={styles.title}>Run compute jobs straight from your AI assistant</h2>
        <p className={styles.description}>
          Drive the Ocean Network from Claude or any other MCP-compatible AI platform. Describe what you want and the AI
          agent writes and validates your algorithm, finds the right compute environment, and runs free or paid jobs for
          you without leaving your chat.
        </p>
        <div className={styles.actions}>
          <Button color="primary-inverse" href={links.mcpDocs} size="lg" target="_blank" variant="filled">
            Get started
          </Button>
        </div>
        <div className={styles.connectorGroup}>
          <span className={styles.connectorLabel}>
            Add it to any MCP-compatible AI platform (Claude, Gemini, ChatGPT, Cursor, GitHub Copilot, and more) using
            the connector URL:
          </span>
          <div className={styles.connector}>
            <code className={styles.connectorUrl}>{links.mcpConnector}</code>
            <CopyButton
              className={styles.copyButton}
              color="accent1"
              contentToCopy={links.mcpConnector}
              variant="filled"
            />
          </div>
        </div>
      </Container>
    </section>
  );
};

export default McpSection;
