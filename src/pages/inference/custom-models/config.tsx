import ConfigPage from '@/components/inference/config-page';
import { InferenceFlowType } from '@/types/inference';

const CustomModelConfigPageWrapper: React.FC = () => <ConfigPage flowType={InferenceFlowType.CustomModel} />;

export default CustomModelConfigPageWrapper;
