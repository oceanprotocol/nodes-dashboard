import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import Withdraw from '@/components/withdraw/withdraw';
import classNames from 'classnames';
import styles from './withdraw-page.module.css';

const WithdrawPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Withdraw funds"
        // TODO: replace with actual subtitle
        subTitle="Withdraw description text"
      />
      <div className={classNames('pageContentWrapper', styles.content)}>
        <Withdraw />
      </div>
    </Container>
  );
};

export default WithdrawPage;
