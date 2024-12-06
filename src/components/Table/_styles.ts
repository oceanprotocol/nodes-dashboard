import { createTheme, TableStyles, Theme } from 'react-data-table-component'

// https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/themes.ts
const theme: Partial<Theme> = {
  text: {
    primary: 'var(-gray-gray-500)',
    secondary: 'var(--color-secondary)',
    disabled: 'var(--color-secondary)'
  },
  background: {
    default: '#fff'
  },
  divider: {
    default: 'var(--border-color)'
  }
}

createTheme('custom', theme)

// https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts
export const customStyles: TableStyles = {
  table: {
    style: {
      backgroundColor: 'white',
      borderRadius: '16px',
      overflow: 'hidden'
    }
  },
  head: {
    style: {
      backgroundColor: '#f8f9fa',
      color: '#6c757d',
      fontWeight: '500',
      textTransform: 'uppercase',
      fontSize: '12px'
    }
  },
  headCells: {
    style: {
      borderBottom: '1px solid #e9ecef',
      padding: '32px 87px'
    }
  },
  rows: {
    style: {
      fontSize: '14px',
      color: '#212529',
      fontFamily: "'Sharp Sans', sans-serif",
      fontWeight: 400,
      lineHeight: '21px',
      '&:not(:last-of-type)': {
        borderBottom: '1px solid #e9ecef'
      }
    }
  },
  cells: {
    style: {
      padding: '32px 87px',
      textAlign: 'left'
    }
  }
}
