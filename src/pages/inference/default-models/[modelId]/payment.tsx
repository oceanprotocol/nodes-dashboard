import PaymentPage from '@/components/inference/payment-page';
import { InferenceFlowType } from '@/types/inference';

const DefaultModelPaymentPageWrapper: React.FC = () => <PaymentPage flowType={InferenceFlowType.DefaultModel} />;

export default DefaultModelPaymentPageWrapper;
