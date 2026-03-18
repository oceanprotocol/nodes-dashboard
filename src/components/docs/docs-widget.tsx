import dynamic from 'next/dynamic';

const GitBookFrame = dynamic(() => import('@gitbook/embed/react').then((mod) => mod.GitBookFrame), { ssr: false });

const DocsWidget: React.FC = () => {
  return (
    <GitBookFrame
      trademark={false}
      tabs={['assistant', 'docs']}
      greeting={{ title: 'Welcome!', subtitle: 'How can I help?' }}
      suggestions={['What is GitBook?', 'How do I get started?']}
      actions={[
        {
          icon: 'circle-question',
          label: 'Contact Support',
          onClick: () => {},
        },
      ]}
    />
  );
};

export default DocsWidget;
