import { SERVICES_CATALOGUE } from '@/components/inference/catalogue-config';
import TemplateDetailsPage from '@/components/inference/template-details-page';

const ServiceDetailsPageWrapper: React.FC = () => <TemplateDetailsPage catalogue={SERVICES_CATALOGUE} />;

export default ServiceDetailsPageWrapper;
