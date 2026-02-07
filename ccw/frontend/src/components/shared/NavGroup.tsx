// ========================================
// NavGroup Component
// ========================================
// Collapsible navigation group using Radix Accordion

import { NavLink, useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info';
  /** When true, only exact path match activates this item (no prefix matching) */
  end?: boolean;
}

export interface NavGroupProps {
  /** Unique identifier for the group */
  groupId: string;
  /** Title i18n key */
  titleKey: string;
  /** Optional icon for group header */
  icon?: React.ElementType;
  /** Navigation items in this group */
  items: NavItem[];
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when nav item is clicked */
  onNavClick?: () => void;
}

export function NavGroup({
  groupId,
  titleKey,
  icon: Icon,
  items,
  collapsed = false,
  onNavClick,
}: NavGroupProps) {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const title = formatMessage({ id: titleKey });

  // If collapsed, render items without accordion
  if (collapsed) {
    return (
      <div className="space-y-1">
        {items.map((item) => {
          const ItemIcon = item.icon;
          const [basePath] = item.path.split('?');
          const isActive = item.end
            ? location.pathname === basePath
            : location.pathname === basePath ||
              (basePath !== '/' && location.pathname.startsWith(basePath + '/'));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavClick}
              className={cn(
                'flex items-center justify-center gap-3 px-2 py-2.5 rounded-md text-sm transition-all duration-200',
                'hover:bg-hover hover:text-foreground hover-glow',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground'
              )}
              title={item.label}
            >
              <ItemIcon className="w-5 h-5 flex-shrink-0" />
            </NavLink>
          );
        })}
      </div>
    );
  }

  return (
    <AccordionItem value={groupId} className="border-none">
      <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-hover/50 rounded-md text-muted-foreground hover:text-foreground">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="w-4 h-4" />}
          <span>{title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-1">
        <ul className="space-y-1">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const [basePath, searchParams] = item.path.split('?');
            const isActive = item.end
              ? location.pathname === basePath
              : location.pathname === basePath ||
                (basePath !== '/' && location.pathname.startsWith(basePath + '/'));
            const isQueryParamActive =
              searchParams && location.search.includes(searchParams);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onNavClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 pl-6',
                    'hover:bg-hover hover:text-foreground hover-glow',
                    (isActive && !searchParams) || isQueryParamActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  <ItemIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-semibold rounded-full',
                        item.badgeVariant === 'success' &&
                          'bg-success-light text-success',
                        item.badgeVariant === 'warning' &&
                          'bg-warning-light text-warning',
                        item.badgeVariant === 'info' && 'bg-info-light text-info',
                        (!item.badgeVariant || item.badgeVariant === 'default') &&
                          'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

export default NavGroup;
