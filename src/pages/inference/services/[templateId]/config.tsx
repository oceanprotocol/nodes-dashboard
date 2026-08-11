import ConfigPage from '@/components/inference/config-page';
import { InferenceFlowType } from '@/types/inference';

const TemplateConfigPageWrapper: React.FC = () => <ConfigPage flowType={InferenceFlowType.Template} />;

export default TemplateConfigPageWrapper;
