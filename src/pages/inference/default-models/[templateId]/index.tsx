import { CURATED_CATALOGUE } from '@/components/inference/catalogue-config';
import TemplateDetailsPage from '@/components/inference/template-details-page';

const CuratedModelDetailsPageWrapper: React.FC = () => <TemplateDetailsPage catalogue={CURATED_CATALOGUE} />;

export default CuratedModelDetailsPageWrapper;
