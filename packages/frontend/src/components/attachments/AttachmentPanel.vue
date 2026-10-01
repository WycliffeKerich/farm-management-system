<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import attachmentService from '@/services/attachment.service';
import { useAuthStore } from '@/stores/auth.store';
import { ACCEPT_ATTRIBUTE, canChangeAttachment, isImage, uploadProblem } from '@/utils/attachments';
import { formatBytes, formatDateTime } from '@/utils/format';
import { validationMessage } from '@/utils/forms';

/**
 * Photos and documents on one record: list, upload, caption, open and delete
 */
const props = defineProps({
    /** The record's table, as the attachments API names it, e.g. activities */
    entityType: { type: String, required: true },
    entityId: { type: Number, required: true },
    canUpload: { type: Boolean, default: true }
});

const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const attachments = ref([]);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref(null);
const pendingFile = ref(null);
const caption = ref('');
const problem = ref(null);

// Images are fetched with the access token, so they are shown from object URLs
const thumbnails = ref({});
const preview = ref(null);
const captionDialog = ref(false);
const editing = ref(null);
const editCaption = ref('');

const releaseThumbnails = () => {
    Object.values(thumbnails.value).forEach((url) => URL.revokeObjectURL(url));
    thumbnails.value = {};
};

const loadThumbnails = async () => {
    for (const attachment of attachments.value.filter(isImage)) {
        if (thumbnails.value[attachment.id]) continue;
        try {
            const blob = await attachmentService.file(attachment.id);
            thumbnails.value = { ...thumbnails.value, [attachment.id]: URL.createObjectURL(blob) };
        } catch {
            // The row still shows; only its picture is missing
        }
    }
};

const load = async () => {
    loading.value = true;
    try {
        const response = await attachmentService.list(props.entityType, props.entityId);
        attachments.value = response.data.data || [];
        loadThumbnails();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load attachments'), life: 4000 });
    } finally {
        loading.value = false;
    }
};

const chooseFile = () => fileInput.value?.click();

const onFileChosen = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    problem.value = uploadProblem(file);
    pendingFile.value = problem.value ? null : file;
};

const cancelUpload = () => {
    pendingFile.value = null;
    caption.value = '';
    problem.value = null;
};

const upload = async () => {
    if (!pendingFile.value) return;
    uploading.value = true;
    try {
        await attachmentService.upload(props.entityType, props.entityId, pendingFile.value, caption.value.trim());
        toast.add({ severity: 'success', summary: 'Attached', detail: pendingFile.value.name, life: 3000 });
        cancelUpload();
        load();
    } catch (error) {
        problem.value = validationMessage(error, 'Upload failed');
    } finally {
        uploading.value = false;
    }
};

const blobOf = async (attachment) => {
    try {
        return await attachmentService.file(attachment.id);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to open the file'), life: 4000 });
        return null;
    }
};

const open = async (attachment) => {
    if (isImage(attachment) && thumbnails.value[attachment.id]) {
        preview.value = attachment;
        return;
    }
    // Opened before the fetch, so the browser does not treat it as a pop-up
    const tab = window.open('', '_blank');
    const blob = await blobOf(attachment);
    if (!blob) {
        tab?.close();
        return;
    }
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const download = async (attachment) => {
    const blob = await blobOf(attachment);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.file_name;
    link.click();
    URL.revokeObjectURL(url);
};

const openCaption = (attachment) => {
    editing.value = attachment;
    editCaption.value = attachment.caption || '';
    captionDialog.value = true;
};

const saveCaption = async () => {
    try {
        await attachmentService.updateCaption(editing.value.id, editCaption.value.trim() || null);
        captionDialog.value = false;
        load();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save the caption'), life: 4000 });
    }
};

const confirmDelete = (attachment) => {
    confirm.require({
        group: 'attachments',
        message: `Delete "${attachment.file_name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await attachmentService.delete(attachment.id);
                toast.add({ severity: 'success', summary: 'Deleted', detail: attachment.file_name, life: 3000 });
                load();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to delete'), life: 4000 });
            }
        }
    });
};

const canChange = (attachment) => canChangeAttachment(attachment, authStore.user);

watch(
    () => [props.entityType, props.entityId],
    () => {
        releaseThumbnails();
        cancelUpload();
        load();
    },
    { immediate: true }
);

onBeforeUnmount(releaseThumbnails);
</script>

<template>
    <div class="flex flex-col gap-3">
        <div v-if="canUpload" class="flex flex-col gap-2">
            <input ref="fileInput" type="file" :accept="ACCEPT_ATTRIBUTE" class="hidden" @change="onFileChosen" />
            <div v-if="!pendingFile">
                <Button label="Attach a photo or document" icon="pi pi-paperclip" severity="secondary" outlined size="small" @click="chooseFile" />
                <small class="block text-surface-500 mt-1">JPEG, PNG, WebP or PDF, up to 10 MB</small>
            </div>
            <div v-else class="flex flex-col md:flex-row md:items-center gap-2 p-3 border border-surface rounded-border">
                <span class="font-medium truncate"><i class="pi pi-file mr-2"></i>{{ pendingFile.name }}</span>
                <span class="text-surface-500 text-sm">{{ formatBytes(pendingFile.size) }}</span>
                <InputText v-model="caption" placeholder="Caption (optional)" maxlength="1000" class="md:flex-1" size="small" />
                <div class="flex gap-1">
                    <Button label="Upload" icon="pi pi-upload" size="small" :loading="uploading" @click="upload" />
                    <Button icon="pi pi-times" severity="secondary" text size="small" :disabled="uploading" @click="cancelUpload" v-tooltip.top="'Cancel'" />
                </div>
            </div>
            <small v-if="problem" class="text-red-500">{{ problem }}</small>
        </div>

        <div v-if="loading" class="text-surface-500 text-sm"><i class="pi pi-spin pi-spinner mr-2"></i>Loading attachments...</div>
        <div v-else-if="attachments.length === 0" class="text-surface-500 text-sm">No attachments</div>
        <ul v-else class="flex flex-col gap-2">
            <li v-for="attachment in attachments" :key="attachment.id" class="flex items-center gap-3 p-2 border border-surface rounded-border">
                <button type="button" class="w-14 h-14 shrink-0 flex items-center justify-center bg-surface-100 dark:bg-surface-800 rounded-border overflow-hidden cursor-pointer" @click="open(attachment)">
                    <img v-if="thumbnails[attachment.id]" :src="thumbnails[attachment.id]" :alt="attachment.caption || attachment.file_name" class="w-full h-full object-cover" />
                    <i v-else :class="isImage(attachment) ? 'pi pi-image' : 'pi pi-file-pdf'" class="text-2xl text-surface-500"></i>
                </button>
                <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{{ attachment.caption || attachment.file_name }}</div>
                    <div class="text-surface-500 text-xs truncate">
                        <span v-if="attachment.caption">{{ attachment.file_name }} · </span>{{ formatBytes(attachment.size_bytes) }} · {{ attachment.uploaded_by_name || 'Unknown' }} · {{ formatDateTime(attachment.created_at) }}
                    </div>
                </div>
                <div class="flex gap-1 shrink-0">
                    <Button icon="pi pi-download" severity="secondary" text rounded size="small" @click="download(attachment)" v-tooltip.top="'Download'" />
                    <template v-if="canChange(attachment)">
                        <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openCaption(attachment)" v-tooltip.top="'Caption'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDelete(attachment)" v-tooltip.top="'Delete'" />
                    </template>
                </div>
            </li>
        </ul>

        <Dialog :visible="!!preview" @update:visible="preview = null" :header="preview?.caption || preview?.file_name" modal :style="{ width: '90vw', maxWidth: '900px' }">
            <img v-if="preview" :src="thumbnails[preview.id]" :alt="preview.caption || preview.file_name" class="w-full h-auto" />
        </Dialog>

        <Dialog v-model:visible="captionDialog" header="Caption" modal :style="{ width: '450px' }">
            <InputText v-model="editCaption" maxlength="1000" class="w-full" autofocus @keyup.enter="saveCaption" />
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="captionDialog = false" />
                <Button label="Save" @click="saveCaption" />
            </template>
        </Dialog>

        <ConfirmDialog group="attachments" />
    </div>
</template>
