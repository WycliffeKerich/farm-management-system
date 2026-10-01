import { describe, expect, it } from 'vitest';
import { buildMenu } from '@/router/menu';
import { routes } from '@/router';

const as = (role) => (roles) => roles.includes(role);
const labels = (menu) => menu.map((section) => section.label);
const items = (menu, sectionLabel) => menu.find((section) => section.label === sectionLabel)?.items.map((item) => item.label) || [];

describe('buildMenu', () => {
    const fixture = [
        {
            path: '/',
            meta: { requiresAuth: true },
            children: [
                { path: '/', meta: { menu: { section: 'home', label: 'Dashboard', icon: 'pi pi-home' } } },
                { path: '/crops', meta: { menu: { section: 'crops', label: 'Overview' } } },
                { path: '/crops/batches/:id' },
                { path: '/users', meta: { roles: ['owner'], menu: { section: 'admin', label: 'Users' } } },
                { path: '/reports', meta: { roles: ['owner', 'manager'] }, children: [{ path: '/reports/sales', meta: { menu: { section: 'admin', label: 'Sales report' } } }] },
                { path: '/stray', meta: { menu: { section: 'unknown', label: 'Stray' } } }
            ]
        },
        { path: '/auth/login', meta: { guestOnly: true } }
    ];

    it('lists only routes with menu entries, in section order', () => {
        const menu = buildMenu(fixture, as('owner'));

        expect(labels(menu)).toEqual(['Home', 'Crop Management', 'Administration']);
        expect(menu[0].items).toEqual([{ label: 'Dashboard', icon: 'pi pi-home', to: '/' }]);
        expect(items(menu, 'Administration')).toEqual(['Users', 'Sales report']);
    });

    it('hides entries the role cannot open, including roles inherited from a parent', () => {
        expect(items(buildMenu(fixture, as('manager')), 'Administration')).toEqual(['Sales report']);
        expect(labels(buildMenu(fixture, as('worker')))).toEqual(['Home', 'Crop Management']);
    });
});

describe('application menu', () => {
    it('shows user management and the audit log to owners only', () => {
        expect(items(buildMenu(routes, as('owner')), 'Administration')).toEqual(expect.arrayContaining(['Users', 'Audit Log', 'Enterprises', 'Farm Settings']));
        for (const role of ['manager', 'worker']) {
            const admin = items(buildMenu(routes, as(role)), 'Administration');
            expect(admin).toEqual(expect.arrayContaining(['Enterprises', 'Farm Settings']));
            expect(admin).not.toContain('Users');
            expect(admin).not.toContain('Audit Log');
        }
    });

    it('never links to a detail route that needs a parameter', () => {
        const links = buildMenu(routes, as('owner')).flatMap((section) => section.items.map((item) => item.to));

        expect(links.length).toBeGreaterThan(0);
        expect(links.filter((path) => path.includes(':'))).toEqual([]);
        expect(new Set(links).size).toBe(links.length);
    });
});
