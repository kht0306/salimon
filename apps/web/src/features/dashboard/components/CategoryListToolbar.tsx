"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { Search } from "lucide-react"
import { Input, Select } from "../styles"
import type {
  CategorySortMode,
  CategoryUsageFilter,
} from "./categoryListPresentation"

interface CategoryListToolbarProps {
  searchQuery: string
  sortMode: CategorySortMode
  usageFilter: CategoryUsageFilter
  dndEnabled: boolean
  onSearchQueryChange: (query: string) => void
  onSortModeChange: (mode: CategorySortMode) => void
  onUsageFilterChange: (filter: CategoryUsageFilter) => void
}

export function CategoryListToolbar({
  searchQuery,
  sortMode,
  usageFilter,
  dndEnabled,
  onSearchQueryChange,
  onSortModeChange,
  onUsageFilterChange,
}: CategoryListToolbarProps) {
  return (
    <Toolbar>
      <CategorySearchField>
        <Search size={15} aria-hidden="true" />
        <Input
          type="search"
          aria-label="카테고리 검색"
          placeholder="카테고리 검색"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </CategorySearchField>
      <CategoryFilterSelect
        aria-label="카테고리 용도 조회"
        value={usageFilter}
        onChange={(event) =>
          onUsageFilterChange(event.target.value as CategoryUsageFilter)
        }
      >
        <option value="all">전체</option>
        <option value="expense">지출용</option>
        <option value="income">수입용</option>
        <option value="saving">저축용</option>
      </CategoryFilterSelect>
      <CategorySortSelect
        aria-label="카테고리 정렬"
        value={sortMode}
        onChange={(event) =>
          onSortModeChange(event.target.value as CategorySortMode)
        }
      >
        <option value="manual">사용자 지정 순서</option>
        <option value="name-asc">이름 오름차순</option>
        <option value="name-desc">이름 내림차순</option>
        <option value="budget-asc">예산 낮은 순</option>
        <option value="budget-desc">예산 높은 순</option>
      </CategorySortSelect>
      {!dndEnabled ? (
        <ReorderHint>
          전체 조회·사용자 지정 순서이며 검색어가 없을 때만 순서를 변경할 수
          있습니다.
        </ReorderHint>
      ) : null}
    </Toolbar>
  )
}

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 8px;

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const CategorySearchField = styled.div`
  position: relative;
  flex: 1;

  svg {
    position: absolute;
    top: 50%;
    left: 11px;
    z-index: 1;
    color: ${colors.muted};
    pointer-events: none;
    transform: translateY(-50%);
  }

  input {
    padding-left: 34px;
  }
`

const CategorySortSelect = styled(Select)`
  width: 180px;

  @media (max-width: 720px) {
    width: 100%;
  }
`

const CategoryFilterSelect = styled(CategorySortSelect)`
  width: 120px;
`

const ReorderHint = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`
