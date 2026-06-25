import ResourcesPage from '@/components/inference/resources-page';
import { InferenceFlowType } from '@/types/inference';

const DefaultModelResourcesPageWrapper: React.FC = () => <ResourcesPage flowType={InferenceFlowType.DefaultModel} />;

export default DefaultModelResourcesPageWrapper;
