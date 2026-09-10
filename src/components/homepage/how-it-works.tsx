import LeftArrow from '@/assets/how-it-works-arrows/left.svg';
import RightArrow from '@/assets/how-it-works-arrows/right.svg';
import StartArrow from '@/assets/how-it-works-arrows/start.svg';
import Card from '@/components/card/card';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './how-it-works.module.css';

const itemsList: {
  title: string;
  description: string;
}[] = [
  {
    title: 'Pick a Model',
    description:
      'Browse the Hugging Face Hub from the wizard: search by name, filter by pipeline tag, sort by trending.',
  },
  {
    title: 'Choose Resources',
    description: 'Pick vLLM or llama.cpp, set the session length, then search environments by GPU type and price.',
  },
  {
    title: 'Configure Launch',
    description: 'Set the engine flags: context window, quantization, tensor parallelism, or any flag of your own.',
  },
  {
    title: 'Fund the Session',
    description: 'The quoted cost goes into escrow for the window you booked, in a single confirmation.',
  },
  {
    title: 'Call the Endpoint',
    description: 'The node pulls the weights and serves an OpenAI-compatible API, with live status and logs.',
  },
];

export default function HowItWorksSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % itemsList.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.root} tabIndex={0} aria-label="How it works, step-by-step">
      <Container className={styles.container}>
        <SectionTitle
          title="How It works"
          subTitle="Serve any open model from the Hugging Face Hub in a few simple steps"
          subTitleClassName="textAccent1Contrast"
          titleClassName="textAccent2"
        />
        <div className={styles.cards}>
          {itemsList.map((item, index) => (
            <React.Fragment key={index}>
              {index === 0 ? (
                <StartArrow
                  className={classNames(styles.startArrow, { [styles.arrowActive]: index === activeIndex })}
                />
              ) : null}
              {index % 2 !== 0 && index < itemsList.length - 1 ? (
                <LeftArrow
                  className={classNames(styles.leftArrow, { [styles.arrowActive]: activeIndex === index + 1 })}
                />
              ) : null}
              <Card
                className={classNames(styles.card, { [styles.cardActive]: index === activeIndex })}
                padding="sm"
                radius="md"
                shadow="black"
                variant="glass-shaded"
              >
                <div className={styles.cardIndex}>0{index + 1}.</div>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDescription}>{item.description}</p>
              </Card>
              {index % 2 === 0 && index < itemsList.length - 1 ? (
                <RightArrow
                  className={classNames(styles.rightArrow, { [styles.arrowActive]: activeIndex === index + 1 })}
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </Container>
    </div>
  );
}
