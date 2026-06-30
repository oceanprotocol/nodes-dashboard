import ResourcesPage from '@/components/inference/resources-page';
import { InferenceFlowType } from '@/types/inference';

const TemplateResourcesPageWrapper: React.FC = () => <ResourcesPage flowType={InferenceFlowType.Template} />;

export default TemplateResourcesPageWrapper;
