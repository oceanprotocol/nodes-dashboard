import InputWrapper from '@/components/input/input-wrapper';
import { Slider as MaterialSlider, styled } from '@mui/material';

const StyledSliderWrapper = styled('div')(() => ({
  padding: '0 12px',
}));

type SliderProps = {
  className?: string;
  errorText?: string;
  hint?: string;
  label?: string;
  marks?: boolean;
  max?: number;
  min?: number;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange?: (e: Event, value: number) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  startAdornment?: React.ReactNode;
  step?: number;
  topRight?: React.ReactNode;
  value?: number;
  valueLabelFormat?: (value: number) => string;
};

const Slider = ({
  className,
  errorText,
  hint,
  label,
  marks,
  max,
  min,
  name,
  onBlur,
  onChange,
  step,
  topRight,
  value,
  valueLabelFormat,
}: SliderProps) => (
  <InputWrapper className={className} errorText={errorText} hint={hint} label={label} topRight={topRight}>
    <StyledSliderWrapper>
      <MaterialSlider
        marks={marks}
        max={max}
        min={min}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        step={step}
        value={value}
        valueLabelDisplay="auto"
        valueLabelFormat={valueLabelFormat}
      />
    </StyledSliderWrapper>
  </InputWrapper>
);

export default Slider;
