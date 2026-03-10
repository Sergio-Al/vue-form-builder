import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
})

export interface FormSummary {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export interface FormDetail extends FormSummary {
  schema: Record<string, any>
  rules: Record<string, any>[]
  updatedAt: string
}

export interface FormResponse {
  id: string
  formId: string
  data: Record<string, any>
  createdAt: string
}

export const getForms = () => api.get<FormSummary[]>('/forms')

export const getForm = (id: string) => api.get<FormDetail>(`/forms/${id}`)

export const createForm = (data: { name: string; description?: string; schema: Record<string, any> }) =>
  api.post<FormDetail>('/forms', data)

export const updateForm = (
  id: string,
  data: { name?: string; description?: string; schema?: Record<string, any>; rules?: Record<string, any>[] },
) => api.put<FormDetail>(`/forms/${id}`, data)

export const deleteForm = (id: string) => api.delete(`/forms/${id}`)

export const submitResponse = (formId: string, data: Record<string, any>) =>
  api.post<FormResponse>('/responses', { formId, data })

export const getResponses = (formId: string) =>
  api.get<FormResponse[]>(`/forms/${formId}/responses`)
