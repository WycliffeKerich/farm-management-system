/**
 * Sidebar sections, in display order. Routes join a section through
 * `meta.menu = { section, label, icon }`; a route without `meta.menu` is not listed.
 */
export const MENU_SECTIONS = [
    { key: 'home', label: 'Home' },
    { key: 'crops', label: 'Crop Management', icon: 'pi pi-fw pi-sun' },
    { key: 'animals', label: 'Animal Management', icon: 'pi pi-fw pi-heart' },
    { key: 'admin', label: 'Administration', icon: 'pi pi-fw pi-cog' }
];

function* flatten(routes, parentRoles = []) {
    for (const route of routes) {
        const roles = route.meta?.roles ? [...parentRoles, route.meta.roles] : parentRoles;
        yield { route, roles };
        if (route.children) {
            yield* flatten(route.children, roles);
        }
    }
}

/**
 * Build the PrimeVue menu model from route definitions
 * @param {Array} routes - Route definitions (router.options.routes)
 * @param {(roles: string[]) => boolean} hasRole - Whether the current user holds one of the roles
 * @returns {Array} Menu model: sections with items, empty sections omitted
 */
export function buildMenu(routes, hasRole) {
    const sections = new Map(MENU_SECTIONS.map((section) => [section.key, { label: section.label, icon: section.icon, items: [] }]));

    for (const { route, roles } of flatten(routes)) {
        const menu = route.meta?.menu;
        if (!menu || !roles.every((allowed) => hasRole(allowed))) continue;

        const section = sections.get(menu.section);
        if (!section) continue;
        section.items.push({ label: menu.label, icon: menu.icon, to: route.path });
    }

    return [...sections.values()].filter((section) => section.items.length > 0);
}
