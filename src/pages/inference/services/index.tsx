import { SERVICES_CATALOGUE } from '@/components/inference/catalogue-config';
import CataloguePage from '@/components/inference/catalogue-page';

const ServicesPageWrapper: React.FC = () => <CataloguePage catalogue={SERVICES_CATALOGUE} />;

export default ServicesPageWrapper;
