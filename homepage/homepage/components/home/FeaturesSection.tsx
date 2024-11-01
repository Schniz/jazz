import { H3 } from "gcmp-design-system/src/app/components/atoms/Headings";
import { Prose } from "gcmp-design-system/src/app/components/molecules/Prose";
import { GappedGrid } from "gcmp-design-system/src/app/components/molecules/GappedGrid";
import { CheckIcon, ImageIcon, UploadCloudIcon, UserIcon } from "lucide-react";
import { LabelledFeatureIcon } from "gcmp-design-system/src/app/components/molecules/LabelledFeatureIcon";
import { Button } from "gcmp-design-system/src/app/components/atoms/Button";
import { ComingSoonBadge } from "gcmp-design-system/src/app/components/atoms/ComingSoonBadge";
import { clsx } from "clsx";
import { SectionHeader } from "gcmp-design-system/src/app/components/molecules/SectionHeader";
import Link from "next/link";

export function FeaturesSection() {
    const features = [
        {
            title: "File uploads",
            icon: UploadCloudIcon,
            description: (
                <>
                    <p>
                        Just use <code>{`<input type="file"/>`}</code>, and
                        easily convert from and to Browser <code>Blobs</code>{" "}
                        using a <code>BinaryCoStream</code> CoValue.
                    </p>
                </>
            ),
        },
        {
            title: "Progressive image loading",
            icon: ImageIcon,
            description: (
                <>
                    Using Jazz&apos;s <code>ImageDefinition</code> component,
                    you get progressive image loading, super fast blur preview,
                    and image size info.
                </>
            ),
        },
        {
            title: "State management",
            icon: ImageIcon,
            description: (
                <>
                    2-way data-binding. Mutate JSON directly. Reactivity is
                    built-in.
                </>
            ),
        },
        {
            title: "Authentication",
            icon: UserIcon,
            description: (
                <>
                    <p>Plug and play different kinds of auth.</p>
                    <ul>
                        <li>WebAuthN (TouchID/FaceID)</li>
                        <li>Clerk</li>
                        <li>
                            Auth0, Okta, NextAuth <ComingSoonBadge />
                        </li>
                    </ul>
                </>
            ),
        },
    ];

    return (
        <div>
            <SectionHeader
                title="Everything else you need to ship quickly"
                slogan={
                    <>
                        <p>
                            We take care of the groundwork that every app needs,
                            so you can focus on building the cool stuff that
                            makes your app unique.
                        </p>
                    </>
                }
            />

            <GappedGrid>
                {features.map(({ title, icon: Icon, description }) => (
                    <LabelledFeatureIcon
                        className="col-span-2"
                        key={title}
                        label={title}
                        icon={Icon}
                        explanation={description}
                    />
                ))}

                <div className="border p-8 bg-gradient-to-t from-blue-50/50 via-30% via-transparent to-transparent shadow-sm rounded-xl col-span-4 space-y-5">
                    <H3>Jazz Cloud</H3>
                    <Prose className="max-w-xl">
                        <p>
                            Jazz Cloud is a real-time sync and storage
                            infrastructure that scales your Jazz app up to
                            millions of users.{" "}
                            <strong>
                                Easy setup, no configuration needed.
                            </strong>
                        </p>
                    </Prose>
                    <ul className="flex gap-4 text-sm">
                        {[
                            "Blob storage",
                            "Data storage",
                            "No limits for public alpha",
                        ].map((feature) => (
                            <li
                                key={feature}
                                className="flex items-center gap-1.5"
                            >
                                <span className="text-blue p-1 rounded-full bg-blue-50 dark:text-blue-500 dark:bg-white/10">
                                    <CheckIcon size={12} strokeWidth={3} />
                                </span>
                                {feature}
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-center gap-x-5 flex-wrap gap-y-3">
                        <Button href="/cloud" variant="primary">
                            View full pricing
                        </Button>
                        <Prose size="sm">
                            You can rely on us, or{" "}
                            <Link href="/docs/sync-and-storage#running-your-own">
                                self-host
                            </Link>
                            .
                        </Prose>
                    </div>
                </div>
            </GappedGrid>
        </div>
    );
}
