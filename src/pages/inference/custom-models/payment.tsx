import PaymentPage from '@/components/inference/payment-page';
import { InferenceFlowType } from '@/types/inference';

const CustomModelPaymentPageWrapper: React.FC = () => <PaymentPage flowType={InferenceFlowType.CustomModel} />;

export default CustomModelPaymentPageWrapper;
