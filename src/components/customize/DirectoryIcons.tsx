import React from 'react';

import closeIcon from '../../assets/customize/directory/close.svg';
import downloadIcon from '../../assets/customize/directory/download.svg';
import navConnectorsIcon from '../../assets/customize/directory/nav-connectors.svg';
import navPluginsIcon from '../../assets/customize/directory/nav-plugins.svg';
import navSkillsIcon from '../../assets/customize/directory/nav-skills.svg';
import pluginApolloIcon from '../../assets/customize/directory/plugin-apollo.svg';
import pluginBioResearchFill from '../../assets/customize/directory/plugin-bio-research-fill.svg';
import pluginCommonRoomIcon from '../../assets/customize/directory/plugin-common-room.svg';
import pluginCustomerSupportFill from '../../assets/customize/directory/plugin-customer-support-fill.svg';
import pluginDataIcon from '../../assets/customize/directory/plugin-data.svg';
import pluginDesignIcon from '../../assets/customize/directory/plugin-design.svg';
import pluginEngineeringIcon from '../../assets/customize/directory/plugin-engineering.svg';
import pluginEnterpriseSearchIcon from '../../assets/customize/directory/plugin-enterprise-search.svg';
import pluginFinanceFill from '../../assets/customize/directory/plugin-finance-fill.svg';
import pluginFinanceOverlay from '../../assets/customize/directory/plugin-finance-overlay.svg';
import pluginHumanResourcesIcon from '../../assets/customize/directory/plugin-human-resources.svg';
import pluginMarketingIcon from '../../assets/customize/directory/plugin-marketing.svg';
import pluginOperationsIcon from '../../assets/customize/directory/plugin-operations.svg';
import pluginPdfViewerIcon from '../../assets/customize/directory/plugin-pdf-viewer.svg';
import pluginProductManagementIcon from '../../assets/customize/directory/plugin-product-management.svg';
import pluginProductivityFill from '../../assets/customize/directory/plugin-productivity-fill.svg';
import pluginSlackIcon from '../../assets/customize/directory/plugin-slack.svg';
import pluginZoomIcon from '../../assets/customize/directory/plugin-zoom.svg';
import searchIcon from '../../assets/customize/directory/search.svg';
import chevronDownIcon from '../../assets/customize/directory/chevron-down.svg';

export type DirectoryNavIconKey = 'skills' | 'connectors' | 'plugins';
export type DirectoryUtilityIconKey = 'close' | 'search' | 'chevron-down' | 'download';
export type DirectoryPluginIconKey =
  | 'productivity'
  | 'design'
  | 'marketing'
  | 'data'
  | 'engineering'
  | 'finance'
  | 'product-management'
  | 'operations'
  | 'enterprise-search'
  | 'human-resources'
  | 'pdf-viewer'
  | 'customer-support'
  | 'apollo'
  | 'slack'
  | 'common-room'
  | 'bio-research'
  | 'zoom';

interface DirectoryIconProps {
  className?: string;
}

const navIcons: Record<DirectoryNavIconKey, string> = {
  skills: navSkillsIcon,
  connectors: navConnectorsIcon,
  plugins: navPluginsIcon,
};

const utilityIcons: Record<DirectoryUtilityIconKey, string> = {
  close: closeIcon,
  search: searchIcon,
  'chevron-down': chevronDownIcon,
  download: downloadIcon,
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function AssetImage({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" aria-hidden="true" className={joinClasses('block shrink-0 object-contain', className)} />;
}

export function DirectoryNavIcon({ className, icon }: DirectoryIconProps & { icon: DirectoryNavIconKey }) {
  return <AssetImage src={navIcons[icon]} className={className} />;
}

export function DirectoryUtilityIcon({ className, icon }: DirectoryIconProps & { icon: DirectoryUtilityIconKey }) {
  return <AssetImage src={utilityIcons[icon]} className={className} />;
}

export function DirectoryPluginIcon({ className, icon }: DirectoryIconProps & { icon: DirectoryPluginIconKey }) {
  const wrapperClassName = joinClasses('relative h-full w-full', className);

  switch (icon) {
    case 'productivity':
      return (
        <div className={wrapperClassName}>
          <AssetImage src={pluginProductivityFill} className="absolute inset-0 h-full w-full" />
        </div>
      );
    case 'design':
      return <AssetImage src={pluginDesignIcon} className={className} />;
    case 'marketing':
      return <AssetImage src={pluginMarketingIcon} className={className} />;
    case 'data':
      return <AssetImage src={pluginDataIcon} className={className} />;
    case 'engineering':
      return <AssetImage src={pluginEngineeringIcon} className={className} />;
    case 'finance':
      return (
        <div className={wrapperClassName}>
          <AssetImage src={pluginFinanceFill} className="absolute inset-0 h-full w-full" />
          <AssetImage src={pluginFinanceOverlay} className="absolute inset-0 h-full w-full" />
        </div>
      );
    case 'product-management':
      return <AssetImage src={pluginProductManagementIcon} className={className} />;
    case 'operations':
      return <AssetImage src={pluginOperationsIcon} className={className} />;
    case 'enterprise-search':
      return <AssetImage src={pluginEnterpriseSearchIcon} className={className} />;
    case 'human-resources':
      return <AssetImage src={pluginHumanResourcesIcon} className={className} />;
    case 'pdf-viewer':
      return <AssetImage src={pluginPdfViewerIcon} className={className} />;
    case 'customer-support':
      return (
        <div className={wrapperClassName}>
          <AssetImage src={pluginCustomerSupportFill} className="absolute inset-0 h-full w-full" />
        </div>
      );
    case 'apollo':
      return <AssetImage src={pluginApolloIcon} className={className} />;
    case 'slack':
      return <AssetImage src={pluginSlackIcon} className={className} />;
    case 'common-room':
      return <AssetImage src={pluginCommonRoomIcon} className={className} />;
    case 'bio-research':
      return (
        <div className={wrapperClassName}>
          <AssetImage src={pluginBioResearchFill} className="absolute inset-0 h-full w-full" />
        </div>
      );
    case 'zoom':
      return <AssetImage src={pluginZoomIcon} className={className} />;
    default:
      return null;
  }
}
