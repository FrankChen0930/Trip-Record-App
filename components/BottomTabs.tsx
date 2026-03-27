'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

interface TabItem {
  label: string;
  icon: string;
  href: string;
  matchPath: string;
}

export default function BottomTabs() {
  const params = useParams();
  const pathname = usePathname();
  const tripId = params?.id as string | undefined;

  // 根據是否在旅程內，顯示不同的 Tab
  const tabs: TabItem[] = tripId
    ? [
        { label: '行程', icon: '🧭', href: `/trip/${tripId}`, matchPath: `/trip/${tripId}` },
        { label: '日記', icon: '📝', href: `/trip/${tripId}/journal`, matchPath: `/trip/${tripId}/journal` },
        { label: '首頁', icon: '🏠', href: '/', matchPath: '/' },
        { label: '照片', icon: '📸', href: `/trip/${tripId}/photos`, matchPath: `/trip/${tripId}/photos` },
        { label: '支出', icon: '💰', href: `/trip/${tripId}/expense`, matchPath: `/trip/${tripId}/expense` },
      ]
    : [
        { label: '首頁', icon: '🏠', href: '/', matchPath: '/' },
        { label: '群組', icon: '🏷️', href: '/groups', matchPath: '/groups' },
        { label: '成員', icon: '👤', href: '/members', matchPath: '/members' },
      ];

  const isActive = (tab: TabItem) => {
    if (tab.matchPath === '/') return pathname === '/';
    return pathname === tab.matchPath || pathname?.startsWith(tab.matchPath + '/');
  };

  return (
    <nav className="btm-tabs">
      <div className="btm-tabs-inner">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`btm-tab ${active ? 'btm-tab-active' : ''}`}
            >
              <span className={`btm-tab-icon ${active ? 'btm-tab-icon-active' : ''}`}>
                {tab.icon}
              </span>
              <span className="btm-tab-label">{tab.label}</span>
              {active && <span className="btm-tab-dot" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
