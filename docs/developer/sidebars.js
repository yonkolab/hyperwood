/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  developerSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Onboarding',
      items: [
        'onboarding/local-setup',
        'onboarding/repo-workflow',
        'onboarding/docs-map',
        'onboarding/testing-strategy',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/system-overview',
        'architecture/request-flow',
        'architecture/persistence-and-ledger',
        'architecture/realtime-model',
        'architecture/auth-access-model',
      ],
    },
    {
      type: 'category',
      label: 'Domain Rules',
      items: [
        'domain-rules/identity-and-access',
        'domain-rules/compliance-gating',
        'domain-rules/funding-and-ledger',
        'domain-rules/trading-and-orders',
        'domain-rules/market-resolution-and-settlement',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      items: [
        'modules/module-map',
        'modules/identity',
        'modules/compliance',
        'modules/funding',
        'modules/orders',
        'modules/matching',
        'modules/markets',
        'modules/portfolio',
        'modules/exchange',
        'modules/operations',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'operations/internal-workflows',
        'operations/alerts-and-scans',
        'operations/reconciliation',
        'operations/settlement-retry',
        'operations/environment-config',
      ],
    },
  ],
};

export default sidebars;
