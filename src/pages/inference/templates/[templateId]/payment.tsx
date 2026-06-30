import PaymentPage from '@/components/inference/payment-page';
import { InferenceFlowType } from '@/types/inference';

const TemplatePaymentPageWrapper: React.FC = () => <PaymentPage flowType={InferenceFlowType.Template} />;

export default TemplatePaymentPageWrapper;
