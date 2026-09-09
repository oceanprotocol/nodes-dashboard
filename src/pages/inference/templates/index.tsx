import { BUNDLES_CATALOGUE } from '@/components/inference/catalogue-config';
import CataloguePage from '@/components/inference/catalogue-page';

const TemplatesPageWrapper: React.FC = () => <CataloguePage catalogue={BUNDLES_CATALOGUE} />;

export default TemplatesPageWrapper;
