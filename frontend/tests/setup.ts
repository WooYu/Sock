import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// Heavy source-backed views can take more than the default one second on Windows workers.
configure({ asyncUtilTimeout: 5000 })
