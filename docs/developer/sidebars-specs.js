/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  specsSidebar: [
    {
      type: 'category',
      label: 'Canonical Specs',
      items: [
        'identity-and-access/spec',
        'compliance-and-regional-controls/spec',
        'funding-and-ledger/spec',
        'trading-and-order-management/spec',
        'matching-and-orderbook/spec',
        'market-catalog-and-lifecycle/spec',
        'portfolio-and-settlement/spec',
        'admin-and-exchange-operations/spec',
        'platform-security-and-observability/spec',
        'realtime-and-historical-data/spec',
        'testing-and-quality-assurance/spec',
        'local-development-environment/spec',
      ],
    },
  ],
};

export default sidebars;
