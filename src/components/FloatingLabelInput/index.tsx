import React, { InputHTMLAttributes } from 'react'
import styles from './styles.module.css'

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: boolean
  helperText?: string
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  error,
  helperText,
  ...props
}) => {
  return (
    <div className={styles.inputContainer}>
      <input
        className={`${styles.input} ${error ? styles.error : ''}`}
        placeholder=" "
        {...props}
      />
      <label className={styles.label}>{label}</label>
      {helperText && (
        <span className={`${styles.helperText} ${error ? styles.errorText : ''}`}>
          {helperText}
        </span>
      )}
    </div>
  )
}

export default FloatingLabelInput
