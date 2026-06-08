import InputWrapper from '@/components/input/input-wrapper';
import { Slider as MaterialSlider, styled } from '@mui/material';

const StyledSliderWrapper = styled('div')(() => ({
  padding: '0 12px',
}));

type SliderProps = {
  className?: string;
  disabled?: boolean;
  errorText?: string;
  hint?: string;
  label?: React.ReactNode;
  marks?: boolean;
  max?: number;
  min?: number;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  startAdornment?: React.ReactNode;
  step?: number;
  topRight?: React.ReactNode;
  valueLabelFormat?: (value: number) => string;
} & (
  | {
      interval?: false;
      onChange: (e: Event, value: number, activeThumb: number) => void;
      value: number;
    }
  | {
      interval: true;
      onChange: (e: Event, value: number[], activeThumb: number) => void;
      value: number[];
    }
);

const Slider = ({
  className,
  disabled,
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
  <InputWrapper
    className={className}
    disabled={disabled}
    errorText={errorText}
    hint={hint}
    label={label}
    topRight={topRight}
  >
    <StyledSliderWrapper>
      <MaterialSlider
        disabled={disabled}
        marks={marks}
        max={max}
        min={min}
        name={name}
        onBlur={onBlur}
        onChange={onChange as (e: Event, value: number | number[], activeThumb: number) => void}
        step={step}
        value={value}
        valueLabelDisplay="auto"
        valueLabelFormat={valueLabelFormat}
      />
    </StyledSliderWrapper>
  </InputWrapper>
);

export default Slider;
