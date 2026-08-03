"use client"

import { useState } from "react"
import { Panel } from "../styles"
import { CategoryCreateForm } from "./CategoryCreateForm"
import { CategoryListSection } from "./CategoryListSection"
import { RecurringRulesSection } from "./RecurringRulesSection"

export function CategoryManager() {
  const [createParentCategoryId, setCreateParentCategoryId] = useState("")

  return (
    <Panel>
      <CategoryCreateForm
        parentCategoryId={createParentCategoryId}
        onParentCategoryChange={setCreateParentCategoryId}
      />
      <CategoryListSection
        onCreateParentCategoryChange={setCreateParentCategoryId}
      />
      <RecurringRulesSection />
    </Panel>
  )
}
