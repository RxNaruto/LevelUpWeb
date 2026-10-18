import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { describeError } from '@/api/client'
import { projectsApi } from '@/api/endpoints'
import { keys, queryClient } from '@/api/queryClient'
import type { ProjectSummary } from '@/api/types'
import { useFeedback } from '@/components/useFeedback'
import { Button, Card, Chip, EmptyState, ErrorState, Input, LoadingState, PageHeader, ProgressBar, Screen } from '@/components/ui'
import { DeadlineChip } from '@/components/DeadlineChip'

export default function Projects() {
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const projects = useQuery({ queryKey: keys.projects, queryFn: projectsApi.list })

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await projectsApi.create({ name: name.trim(), description: '', deadline: null, estimatedMinutes: null })
      setName('')
      setAdding(false)
      await queryClient.invalidateQueries({ queryKey: keys.projects })
    } catch (error) {
      toast(describeError(error), { title: 'Could not create project', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (projects.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading projects…" fullScreen />
      </Screen>
    )
  }

  if (projects.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(projects.error)} onRetry={() => void projects.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <PageHeader title="Projects" subtitle="Longer efforts with milestones and logged time." />

      {adding ? (
        <Card className="gap-lg mb-lg">
          <form className="stack gap-lg" onSubmit={(event) => void create(event)}>
            <Input
              label="Project name"
              placeholder="Ship LevelUp v1"
              value={name}
              maxLength={120}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
            <div className="row gap-sm">
              <Button type="submit" title="Create" size="sm" loading={saving} disabled={!name.trim()} />
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false)
                  setName('')
                }}
              />
            </div>
          </form>
        </Card>
      ) : (
        <Button title="New project" fullWidth className="mb-lg" onClick={() => setAdding(true)} />
      )}

      {projects.data.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Group related tasks under a project to track milestones and time spent."
          icon="◆"
        />
      ) : (
        <div className="stack gap-md">
          {projects.data.map((project: ProjectSummary) => {
            const pct = project.milestoneCount ? project.milestonesDone / project.milestoneCount : 0
            const hours = (project.totalMinutes / 60).toFixed(1)

            return (
              <Card key={project.id} className="gap-md" onClick={() => navigate(`/projects/${project.id}`)}>
                <div className="row start between gap-md">
                  <h2 className="t-subheading grow clamp-2">{project.name}</h2>
                  {project.status === 'COMPLETED' ? <Chip label="done" variant="success" /> : null}
                </div>

                {project.description ? <p className="t-body-muted clamp-2">{project.description}</p> : null}

                <div className="row wrap gap-xs">
                  <DeadlineChip deadline={project.deadline} />
                  <Chip label={`${project.taskCount} tasks`} />
                  <Chip label={`${hours}h logged`} />
                </div>

                {project.milestoneCount > 0 ? (
                  <div className="stack gap-sm">
                    <span className="t-caption">
                      {project.milestonesDone} of {project.milestoneCount} milestones
                    </span>
                    <ProgressBar value={pct} />
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
