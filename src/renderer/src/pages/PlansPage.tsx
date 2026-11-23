import { Layers, Pencil, Plus, Power, PowerOff, Users } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { formatCurrency, formatNumber } from '../lib/format'
import { useWorkspace, useWorkspaceData } from '../workspace/WorkspaceProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { SummaryStat } from '../components/ui/Controls'
import { SectionCard } from '../components/ui/SectionCard'
import { PlanFormModal } from '../components/plans/PlanFormModal'
import type { PlanRecord } from '@shared/analytics'

export function PlansPage() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()
  const { refresh } = useWorkspace()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const openCreate = () => {
    setEditingPlan(null)
    setActionError(null)
    setFormOpen(true)
  }

  const openEdit = (plan: PlanRecord) => {
    setEditingPlan(plan)
    setActionError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) return
    setFormOpen(false)
    setEditingPlan(null)
  }

  const handleSubmit = async (input: Parameters<typeof window.gymPro.plans.create>[0]) => {
    setSubmitting(true)
    setActionError(null)
    try {
      if (editingPlan) {
        await window.gymPro.plans.update(editingPlan.id, input)
      } else {
        await window.gymPro.plans.create(input)
      }
      setFormOpen(false)
      setEditingPlan(null)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (plan: PlanRecord) => {
    setActionError(null)
    try {
      await window.gymPro.plans.setActive(plan.id, !plan.isActive)
      await refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('errors.workspaceDescription'))
    }
  }

  return (
    <div className="animate-fade-in space-y-4 xl:space-y-5">
      {actionError ? (
        <div className="rounded-xl border border-rose/25 bg-rose/10 px-3 py-2 text-[11px] text-rose">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <SummaryStat
          icon={Layers}
          label={t('plans.total')}
          value={formatNumber(snapshot.totals.totalPlans, locale)}
          accent="purple"
        />
        <SummaryStat
          icon={Layers}
          label={t('plans.active')}
          value={formatNumber(snapshot.totals.activePlans, locale)}
          accent="emerald"
        />
        <SummaryStat
          icon={Users}
          label={t('plans.subscribers')}
          value={formatNumber(snapshot.totals.activeSubscriptions, locale)}
          accent="amber"
        />
      </div>

      <SectionCard
        title={t('nav.plans')}
        subtitle={`${formatNumber(snapshot.plans.length, locale)} ${t('common.records')}`}
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/15 px-3.5 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/25 hover:text-primary"
          >
            <Plus className="size-3.5" />
            {t('plans.addPlan')}
          </button>
        }
      >
        {snapshot.plans.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('plans.emptyTitle')}
            description={t('plans.emptyDescription')}
          />
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.plans.map((plan) => (
              <article
                key={plan.id}
                className="panel panel-hover relative overflow-hidden rounded-[24px] p-5"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${
                    plan.isActive
                      ? 'from-transparent via-purple/60 to-transparent'
                      : 'from-transparent via-white/15 to-transparent'
                  }`}
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`icon-tile size-11 rounded-2xl ${
                      plan.isActive ? 'text-purple-soft' : 'text-dim'
                    }`}
                  >
                    <Layers className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(plan)}
                      aria-label={t('plans.editPlan')}
                      className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-purple/30 hover:text-purple-soft"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(plan)}
                      aria-label={plan.isActive ? t('plans.inactiveBadge') : t('plans.activeBadge')}
                      className="inline-grid size-7 place-items-center rounded-lg border border-white/[0.06] text-dim transition-colors hover:border-emerald/30 hover:text-emerald"
                    >
                      {plan.isActive ? (
                        <PowerOff className="size-3.5" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <h2 className="mt-4 truncate text-base font-semibold text-primary">
                  {plan.name}
                </h2>
                <p className="mt-1 line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-muted">
                  {plan.description ?? '—'}
                </p>

                <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.055] pt-4">
                  <div>
                    <p className="font-display text-2xl font-semibold text-purple-soft">
                      {formatCurrency(plan.price, locale, t('common.currency'))}
                    </p>
                    <p className="mt-1 text-[10px] text-dim">
                      {formatNumber(plan.durationDays, locale)}{' '}
                      {t('plans.durationUnit')}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-display text-xl font-semibold text-primary">
                      {formatNumber(plan.activeSubscribers, locale)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-dim">
                      {t('plans.activeSubscribers')}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                      plan.isActive
                        ? 'border-emerald/25 bg-emerald/10 text-emerald'
                        : 'border-white/10 bg-white/[0.045] text-muted'
                    }`}
                  >
                    {t(plan.isActive ? 'plans.activeBadge' : 'plans.inactiveBadge')}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <PlanFormModal
        open={formOpen}
        initial={editingPlan}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
