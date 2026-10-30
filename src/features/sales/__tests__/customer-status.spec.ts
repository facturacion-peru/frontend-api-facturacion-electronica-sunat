import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CustomerVerifiedBadge from '../components/CustomerVerifiedBadge.vue'
import RucStatusAlert from '../components/RucStatusAlert.vue'

/*
 * Spec 018 · F003: insignia Verificado/Manual (HU-2 esc. 4) y aviso del RUC (A-95).
 */
describe('CustomerVerifiedBadge', () => {
  it('«Verificado» lleva la fecha de la consulta, también para el lector de pantalla', () => {
    const badge = mount(CustomerVerifiedBadge, { props: { customer: { verified: true, verified_at: '2026-10-30T15:00:00-05:00' } } })

    expect(badge.text()).toMatch(/^Verificado, consultado el /)
    expect(badge.attributes('title')).toMatch(/^Consultado el /)
  })

  it('un cliente registrado a mano dice «Manual»', () => {
    expect(mount(CustomerVerifiedBadge, { props: { customer: { verified: false, verified_at: null } } }).text()).toBe('Manual')
  })
})

describe('RucStatusAlert', () => {
  const alert = (ruc_status: string | null, ruc_condition: string | null, document_type: '1' | '6' = '6') =>
    mount(RucStatusAlert, { props: { customer: { document_type, ruc_status, ruc_condition } } })

  it('avisa con un RUC de baja o no habido, sin bloquear', () => {
    expect(alert('BAJA DE OFICIO', 'HABIDO').text()).toBe('Este RUC figura como BAJA DE OFICIO en SUNAT. Puedes emitir, pero confírmalo con el cliente.')
    expect(alert('ACTIVO', 'NO HABIDO').text()).toContain('figura como NO HABIDO')
    expect(alert('SUSPENSION TEMPORAL', 'NO HALLADO').text()).toContain('SUSPENSION TEMPORAL y NO HALLADO')
  })

  it('no avisa con un RUC activo y habido, sin datos o si no es RUC', () => {
    expect(alert('ACTIVO', 'HABIDO').find('[data-test="ruc-status-alert"]').exists()).toBe(false)
    expect(alert(null, null).find('[data-test="ruc-status-alert"]').exists()).toBe(false)
    expect(alert('BAJA DE OFICIO', null, '1').find('[data-test="ruc-status-alert"]').exists()).toBe(false)
  })
})
