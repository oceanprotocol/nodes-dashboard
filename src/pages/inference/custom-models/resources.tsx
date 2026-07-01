import ResourcesPage from '@/components/inference/resources-page';
import { InferenceFlowType } from '@/types/inference';

const CustomModelResourcesPageWrapper: React.FC = () => <ResourcesPage flowType={InferenceFlowType.CustomModel} />;

export default CustomModelResourcesPageWrapper;
