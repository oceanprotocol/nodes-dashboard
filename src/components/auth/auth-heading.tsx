import styles from './auth-heading.module.css';

type AuthHeadingProps = {
  emphasis: string;
  title: string;
};

const AuthHeading = ({ emphasis, title }: AuthHeadingProps) => (
  <h1 className={styles.root}>
    {title} <em>{emphasis}</em>
  </h1>
);

export default AuthHeading;
