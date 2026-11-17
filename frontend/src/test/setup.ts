import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// findBy and waitFor give up after 1s by default. The first render in a test file can take longer
// than that on a busy machine or CI runner, which made tests fail without any real bug.
configure({ asyncUtilTimeout: 4000 })
