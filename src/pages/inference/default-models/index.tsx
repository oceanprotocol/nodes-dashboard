import { CURATED_CATALOGUE } from '@/components/inference/catalogue-config';
import CataloguePage from '@/components/inference/catalogue-page';

const CuratedModelsPageWrapper: React.FC = () => <CataloguePage catalogue={CURATED_CATALOGUE} />;

export default CuratedModelsPageWrapper;
