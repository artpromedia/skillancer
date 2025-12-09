import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const features = [
  {
    title: 'Getting Started',
    icon: '🚀',
    description: 'Set up your development environment and start building with Skillancer.',
    link: '/getting-started',
  },
  {
    title: 'Architecture',
    icon: '🏗️',
    description: 'Understand the system architecture, tech stack, and design decisions.',
    link: '/architecture',
  },
  {
    title: 'API Reference',
    icon: '📡',
    description: 'Complete API documentation for all Skillancer services.',
    link: '/api',
  },
  {
    title: 'Runbooks',
    icon: '📋',
    description: 'Operational guides for deployment, incidents, and maintenance.',
    link: '/runbooks',
  },
];

function Feature({ title, icon, description, link }) {
  return (
    <div className={clsx('col col--3')}>
      <Link to={link} className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
      </Link>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/getting-started">
            Get Started →
          </Link>
          <Link className="button button--secondary button--lg" to="/architecture">
            View Architecture
          </Link>
        </div>
      </div>
    </header>
  );
}

function QuickLinks() {
  return (
    <section className={styles.quickLinks}>
      <div className="container">
        <h2>Quick Links</h2>
        <div className="row">
          <div className="col col--4">
            <div className={styles.quickLinkCard}>
              <h4>📦 Installation</h4>
              <code>git clone && pnpm install && pnpm dev</code>
              <Link to="/getting-started/installation">Full guide →</Link>
            </div>
          </div>
          <div className="col col--4">
            <div className={styles.quickLinkCard}>
              <h4>🧪 Running Tests</h4>
              <code>pnpm test</code>
              <Link to="/getting-started/testing">Testing guide →</Link>
            </div>
          </div>
          <div className="col col--4">
            <div className={styles.quickLinkCard}>
              <h4>🔧 Code Generation</h4>
              <code>pnpm generate</code>
              <Link to="/getting-started/code-generation">Generator docs →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
        <QuickLinks />
      </main>
    </Layout>
  );
}
